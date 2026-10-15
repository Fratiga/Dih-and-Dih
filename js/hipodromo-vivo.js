/* =============================================================================
   HIPÓDROMO EN VIVO (hipodromo-vivo.html). Una pista a pantalla completa para vivir las carreras. No hace cuentas ni guarda nada:
   lee el mismo mundo que la página principal y lo pone a la vista.

   - El reloj es el global del servidor (js/hipodromo-online.js: ahora()). Cada carrera sale a su hora; lo que se ve en cada
     instante depende solo de esa hora, así que entrar a mitad de carrera, recargar o abrirla en dos pestañas enseña lo mismo.
   - Cada carrera pasa por cinco fases: espera, preparación (los 30 s antes de la salida), carrera, resultados (30 s) y
     recuperación (2 min). Después de la recuperación sale la pista de salida con las criaturas de la siguiente carrera.
   - Las posiciones en carrera son las del resultado que guarda el servidor (HipodromoPista.trayectorias, las mismas de la
     toma de la página principal). Nadie decide un ganador aquí.
   - Las criaturas son el SVG de siempre en piezas (HipodromoDibujo con vivo) movidas por js/hipodromo-vida.js.
   - La música es la de la página (js/musica-paginas.js): la lista "de fondo" es la de espera y la de "partida" es la de carrera.
   - Sin sesión, o con ?local en la dirección, corre un mundo de prueba en este navegador con el reloj adelantable.
   Mira docs/hipodromo.md.
============================================================================= */
(function () {
  "use strict";
  const M = window.HipodromoMotor, D = window.HipodromoDibujo, PI = window.HipodromoPista, V = window.HipodromoVida;
  if (!M || !D || !PI || !V) return;
  const C = M.C, clamp = V.util.clamp, acerca = V.util.acerca, suave = V.util.suave, azar = PI.azar, hash = PI.hash;
  const $ = id => document.getElementById(id);
  const escH = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60; return h ? `${h}:${pad(mi)}:${pad(s % 60)}` : `${pad(mi)}:${pad(s % 60)}`; };
  const poner = (el, html) => { if (el && el._h !== html) { el.innerHTML = html; el._h = html; } };
  const textoDe = (el, t) => { if (el && el._t !== t) { el.textContent = t; el._t = t; } };

  const T_PREP = 30, T_RES = 30, T_RECUP = 120;     // segundos: preparación antes de la salida, resultados y recuperación después de la meta
  const T_FUNDIDO = 700;                             // ms del fundido entre la pista de meta y la de salida
  const TAU_FRENO = 1.6, TAU_LIBRE = 9;              // al cruzar la meta: lo que tardan en frenar y en quedar libres
  const HZ = 0.33, CBASE = 0.9, CANCHO = 0.36;       // dónde está el horizonte y el espacio de los carriles (fracción del alto)
  const FASES = { espera: "En espera", preparacion: "Preparación", carrera: "En carrera", resultados: "Resultados", recuperacion: "Recuperación", vacio: "Sin carrera" };
  const params = new URLSearchParams(location.search);

  let W = 0, H = 0, dpr = 1;
  let fuente = null, aviso = "";
  const registro = new Map();                        // n -> { n, hora, prog, res, pers, suspendida, ... }
  let grupo = null, cambio = null, camara = { g: 0, gp: 7, pxM: 7, c: 0 };
  let ultimoMarco = 0, ultimoHud = 0, mensajeHasta = 0, musicaCarrera = null, ultimaFase = null;
  let panel = { n: null, cerrado: false };

  /* ---------------------------------------------------------------- datos: el registro de carreras */
  function registrar(prog, res) {
    if (!prog || prog.n == null) return null;
    let r = registro.get(prog.n);
    if (!r) { r = { n: prog.n, hora: prog.hora, prog: null, res: null, suspendida: false, pers: new Map(), intentos: 0, ultimo: 0, buscando: false }; registro.set(prog.n, r); }
    r.prog = Object.assign({}, prog); delete r.prog.secreto;
    r.hora = prog.hora; r.suspendida = !!prog.suspendida;
    if (res && !r.res) r.res = res;
    completarPerfiles(r);
    return r;
  }
  function completarPerfiles(r) {
    const faltan = [];
    ((r.prog && r.prog.entrantes) || []).forEach(e => {
      if (r.pers.has(e.id)) return;
      const p = fuente && fuente.perfil(e.id);
      if (p) r.pers.set(e.id, p); else faltan.push(e.id);
    });
    if (faltan.length && fuente && fuente.pedir) fuente.pedir(faltan).then(() => completarPerfiles(r)).catch(() => {});
  }
  function podar() {
    const ahora = fuente.ahora();
    registro.forEach((r, n) => { if (r.hora < ahora - 20 * 60000) registro.delete(n); });
  }

  /* modo servidor */
  let previa = 0;
  const intentadas = new Set();   // anteriores que ya se intentó traer (se hayan encontrado o no)
  async function asegurarPrevia(p) {
    const n = p.n - 1, ahora = fuente.ahora();
    if (n < 0 || registro.has(n) || previa === n) return;
    if (ahora > p.hora - C.MINUTOS * 60000 + 6 * 60000) return;   // la anterior ya quedó lejos: no hace falta
    previa = n;
    try {
      const { data: fila } = await fuente.supa.from("hipodromo_programa").select("n, hora, cierre, publico").eq("n", n).maybeSingle();
      if (fila) {
        const prog = Object.assign({}, fila.publico); prog.n = fila.n; prog.hora = new Date(fila.hora).getTime(); prog.cierre = new Date(fila.cierre).getTime();
        if (fuente.pedir) await fuente.pedir((prog.entrantes || []).map(e => e.id));
        const { data: car } = await fuente.supa.from("hipodromo_carreras").select("resultado").eq("n", n).maybeSingle();
        registrar(prog, car && car.resultado);
      }
    } catch (e) { /* sin la anterior se ve la espera de la siguiente: no pasa nada */ }
    previa = 0; intentadas.add(n);
  }
  /* Al abrir la página poco después de una carrera hay que traer esa carrera para enseñarla: hasta entonces no se muestra nada (así no parpadea la espera de la siguiente) */
  function esperandoPrevia() {
    if (!fuente || fuente.modo !== "servidor") return false;
    let ult = null; registro.forEach(r => { if (!ult || r.n > ult.n) ult = r; });
    if (!ult || ult.n < 1 || registro.has(ult.n - 1) || intentadas.has(ult.n - 1)) return false;
    return fuente.ahora() <= ult.hora - C.MINUTOS * 60000 + 6 * 60000;
  }
  function sincronizarServidor() {
    if (!fuente || fuente.modo !== "servidor") return;
    const p = fuente.en.m.proxima;
    if (!p) return;
    registrar(p, p.secreto && p.secreto.res);
    podar();
    asegurarPrevia(p);
  }
  async function buscarResultado(r) {
    r.buscando = true; r.ultimo = Date.now(); r.intentos++;
    try {
      const { data } = await fuente.supa.from("hipodromo_carreras").select("resultado").eq("n", r.n).maybeSingle();
      if (data && data.resultado) r.res = data.resultado;
    } catch (e) { /* se vuelve a intentar */ }
    r.buscando = false;
  }
  /* El resultado solo se ve desde la hora de salida (la base de datos lo guarda hasta entonces): se pide pegado a la salida y a menudo */
  function tickDatos() {
    if (!fuente) return;
    const ahora = fuente.ahora();
    if (fuente.modo === "servidor") {
      registro.forEach(r => {
        if (r.res || r.suspendida || r.buscando || ahora < r.hora - 300) return;
        if (Date.now() - r.ultimo >= (r.intentos < 40 ? 300 : 3000)) buscarResultado(r);
      });
    } else {
      const m = fuente.mundo;
      let tope = 0;
      while (ahora >= m.proxima.hora + C.APLICAR_SEG * 1000 && tope++ < 4) {
        M.avanzar(m, { sims: 24 });
        registrar(m.proxima, m.proxima.secreto && m.proxima.secreto.res);
      }
      podar();
    }
    registro.forEach(completarPerfiles);
  }

  /* modo local (prueba): un mundo pequeño en este navegador */
  function iniciarLocal() {
    const r = M.paso(null, Date.now(), { calentar: 30, semilla: "vivo-local", simsCalentar: 6 });
    const mundo = r.lote.mundo, base = mundo.proxima.hora;
    const rel = params.has("t") && Number.isFinite(Number(params.get("t"))) ? Number(params.get("t")) : -75;
    let desfase = base + rel * 1000 - Date.now();
    fuente = {
      modo: "local", mundo, base, ahora: () => Date.now() + desfase,
      perfil: id => { const c = M.buscar(mundo, id); return c ? M.perfil(mundo, c) : null; },
      saltar: seg => { desfase = base + seg * 1000 - Date.now(); }
    };
    registrar(mundo.proxima, mundo.proxima.secreto && mundo.proxima.secreto.res);
    $("hvLocal").hidden = false;
    $("hvLocal").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { fuente.saltar(Number(b.dataset.salto)); cambio = null; destruirGrupo(); }));
  }
  async function iniciar() {
    if (params.has("local")) { aviso = "Prueba local: un mundo que corre solo en este navegador."; iniciarLocal(); return; }
    let r = null;
    try {
      r = await Promise.race([window.HipodromoOnline.conectar(M, () => sincronizarServidor()), new Promise(ok => setTimeout(() => ok({ ok: false, motivo: "tiempo" }), 15000))]);
    } catch (e) { r = { ok: false, motivo: "servidor" }; }
    if (!r || !r.ok) {
      aviso = r && r.motivo === "sesion" ? "Sin sesión no se puede ver la carrera de todos. Mira una carrera de prueba." : "No hay conexión con el hipódromo. Mira una carrera de prueba.";
      iniciarLocal();
      return;
    }
    const en = r.en;
    fuente = { modo: "servidor", en, supa: en.supa, ahora: en.ahora, perfil: id => en.perfil(id), pedir: ids => en.pedir(ids) };
    sincronizarServidor();
  }

  /* ---------------------------------------------------------------- qué toca ver ahora */
  const durVis = r => PI.duracionCarrera(r.prog.dist);
  function escenaDe(ahora) {
    const lista = [...registro.values()].filter(r => r.prog && !r.suspendida && r.prog.entrantes && r.prog.entrantes.length).sort((a, b) => a.n - b.n);
    let actual = null, prox = null;
    for (const r of lista) { if (r.hora <= ahora) actual = r; else if (!prox) prox = r; }
    if (actual) {
      const post = (ahora - (actual.hora + durVis(actual) * 1000)) / 1000;
      if (post < T_RES + T_RECUP) return { fase: post < 0 ? "carrera" : post < T_RES ? "resultados" : "recuperacion", reg: actual, el: (ahora - actual.hora) / 1000, post, prox };
    }
    if (prox) { const falta = (prox.hora - ahora) / 1000; return { fase: falta <= T_PREP ? "preparacion" : "espera", reg: prox, falta, prox }; }
    return { fase: "vacio", reg: null, prox: null };
  }

  /* ---------------------------------------------------------------- medidas de la pantalla */
  function medidas() {
    const gpI = clamp(W / 190, 4.5, 9), bw = clamp(Math.min(W * 0.2, H * 0.34), 110, 300);
    return { gpI, bw, ancho: bw * 0.72 / gpI };
  }
  function zonaDe(tipo, dist) {
    const m = medidas();
    if (tipo === "inicio") return { x0: -0.8 * W / m.gpI + m.ancho * 0.7, x1: -m.ancho * 1.1, salida: 0.3 * W / m.gpI, cam: -0.3 * W / m.gpI };
    const fin = dist + 0.72 * W / m.gpI;
    return { x0: dist + m.ancho * 0.9, x1: fin - m.ancho * 0.7, salida: fin + m.ancho * 1.6, cam: dist + 0.22 * W / m.gpI };
  }
  function medirPantalla() {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    W = Math.max(280, window.innerWidth); H = Math.max(260, window.innerHeight);
    if (grupo) grupo.escenario.medir(W, H, dpr);
    else { [$("hvFondo"), $("hvFrente")].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }); }
  }

  /* ---------------------------------------------------------------- el grupo: la pista y las criaturas de una carrera */
  function destruirGrupo() {
    if (!grupo) return;
    grupo.w.forEach(w => w.el.remove());
    grupo.puertas.forEach(p => p.remove());
    grupo = null;
  }
  const nombreClima = c => (M.CLIMAS[c] ? M.CLIMAS[c].texto : c);

  function construirGrupo(reg, entrada) {
    destruirGrupo();
    const prog = reg ? reg.prog : { n: null, pista: "pesares", dist: 1600, entrantes: [], climaPrevio: "despejado" };
    const res = reg ? reg.res : null;
    const suelo = M.PISTAS[prog.pista] || M.PISTAS.pesares, n = prog.entrantes.length;
    const g = { n: reg ? reg.n : null, reg, dist: prog.dist, w: [], puertas: [], tray: null, polvo: [], ganadorVisto: false, aviso: "", resAplicada: false, tPolvo: 0, abierta: false, snap: true };
    g.escenario = PI.escenario($("hvFondo"), $("hvFrente"), {
      dist: prog.dist, lanes: Math.max(2, n), clima: res ? res.clima : prog.climaPrevio, estadoPista: res ? res.estadoPista : "bueno",
      suelo: suelo.suelo, cuestas: suelo.cuestas, arcana: suelo.arcana || null,
      zonas: suelo.arcana ? M.zonasArcanas(suelo.arcana, prog.n || 0, prog.dist / 100) : [],
      semilla: hash("pista" + prog.n + prog.pista), rayosAzar: true, horizonte: HZ, carrilBase: CBASE, carrilAncho: CANCHO
    });
    g.escenario.medir(W, H, dpr);
    grupo = g;
    if (res) aplicarResultado(g);
    const capa = $("hvCapa"), marcadas = new Set();
    if (fuente && fuente.en) fuente.en.est.pendientes.filter(a => a.n === prog.n).forEach(a => (a.nombres || []).forEach(x => marcadas.add(x)));
    const zi = zonaDe("inicio", prog.dist), mundo0 = mundoDe(g, "inicio", 0);
    prog.entrantes.forEach((e, i) => {
      const per = reg.pers.get(e.id);
      if (!per) return;
      const el = document.createElement("div");
      el.className = "hv-cab" + (marcadas.has(e.nombre) ? " mia" : "");
      el.innerHTML = `<div class="hv-giro">${D.silueta(per, { clase: "hv-sil", numero: e.puerta, vivo: true, titulo: e.nombre })}</div><span class="hv-nombre"><b>${e.puerta}</b>${escH(e.nombre)}</span><span class="hv-aviso-cab"></span>`;
      capa.appendChild(el);
      const tit = V.crearTitere(el.querySelector("svg")), a = V.crearActor({ id: e.id, titere: tit, semilla: hash("v" + e.id) % 100000 + 1 });
      const w = { a, el, giro: el.firstChild, nom: el.querySelector(".hv-nombre"), av: el.querySelector(".hv-aviso-cab"), e, i, f: n <= 1 ? 0 : i / (n - 1), per, libre: false, frenoK: 0.8 + 0.45 * azar(hash("fr" + e.id))(), vm: 0, xAnt: null, modo: "quieto", lugar: i + 1, prep: null, v0: null, tropiezo: null, wAncho: 0, visible: true, flipPrev: 2 };
      g.w.push(w);
      // dónde estaban cuando se abrió la página (o por dónde entran si llegan de la siguiente carrera)
      const rng = azar(hash("pos" + prog.n + e.id));
      a.f = rng(); a.dir = rng() < 0.5 ? -1 : 1; a.flip = a.dir;
      if (entrada) {
        a.x = zi.x0 - mundo0.ancho * (2 + i * 0.9); a.dir = 1; a.flip = 1;
        V.entrar(a, "caminar", mundo0); a.dest = { x: zi.x0 + rng() * (zi.x1 - zi.x0), f: rng() };
      } else {
        a.x = zi.x0 + rng() * (zi.x1 - zi.x0);
        const r = rng();
        if (r < 0.3) V.ponerPostura(a, "pastar"); else if (r < 0.52) V.ponerPostura(a, "mirar"); else if (r < 0.68) V.ponerPostura(a, "echar");
        else if (r < 0.78) V.ponerPostura(a, "sentar"); else { V.entrar(a, "caminar", mundo0); }
        a.t = rng() * a.dur;
      }
      // puerta de salida de este carril
      const pu = document.createElement("div");
      pu.className = "hv-puerta"; pu.innerHTML = "<i></i>";
      capa.appendChild(pu);
      g.puertas.push(pu);
    });
    $("hvCargando").classList.add("hidden");
    const camIni = zonaDe("inicio", prog.dist).cam;
    camara = { g: camIni, gp: medidas().gpI, pxM: medidas().gpI, c: camIni };
    return g;
  }

  /* El resultado llegó (o ya estaba): con él se sabe cómo corre cada una. El clima y el terreno cambian poco a poco, no de golpe. */
  function aplicarResultado(g) {
    const reg = g.reg, res = reg.res;
    if (!res || g.resAplicada) return;
    g.resAplicada = true;
    const carriles = reg.prog.entrantes.map(e => {
      const l = res.llegada.find(x => x.id === e.id);
      return { id: e.id, nombre: e.nombre, puerta: e.puerta, tramos: res.tramos[e.id], pos: l.pos, t: l.t, lesion: !!l.lesion };
    });
    g.tray = PI.trayectorias(res, carriles);
    g.escenario.ponerClima(res.clima, res.estadoPista, g.w.length ? 7 : 0);
    g.incidentes = (res.incidentes || []).map(x => Object.assign({}, x, { visto: false }));
  }

  /* lo que cada criatura puede hacer en un trozo de pista */
  function mundoDe(g, tipo, cansado) {
    const m = medidas(), z = zonaDe(tipo, g.dist);
    return { x0: z.x0, x1: z.x1, salida: z.salida, vPaso: 0.3 * m.bw / m.gpI, ancho: m.ancho, otros: g.w.map(w => w.a), cansado };
  }

  /* ---------------------------------------------------------------- qué hace cada criatura según la fase */
  function libres(g, ec, dt, tipo, cansado) {
    const mundo = mundoDe(g, tipo, cansado);
    // que no se pisen: si dos están casi en el mismo sitio, se apartan despacio en profundidad
    const libresW = g.w.filter(w => (tipo !== "meta" || w.libre) && w.a.estado !== "fuera");
    for (let i = 0; i < libresW.length; i++) for (let j = i + 1; j < libresW.length; j++) {
      const p = libresW[i].a, q = libresW[j].a;
      if (Math.abs(p.x - q.x) < mundo.ancho * 0.6 && Math.abs(p.f - q.f) * 45 < 6 && p.socio !== q) {
        const d = (p.f >= q.f ? 1 : -1) * 0.3 * dt; p.f = clamp(p.f + d, 0, 1); q.f = clamp(q.f - d, 0, 1);
      }
    }
    g.w.forEach(w => {
      if (w.libre === false && tipo === "meta") return;
      const a = w.a;
      if (a.estado === "fuera") return;
      const r = V.pensarLibre(a, dt, mundo);
      w.modo = r.modo; w.vm = Math.abs(r.v);
      if (tipo === "meta") a.obj.jadeo = clamp(cansado * 0.9 * (a.estado === "echar" || a.estado === "sentar" ? 0.5 : 1), 0, 1);
    });
  }

  /* Preparación: lo que pasa en los 30 s antes de la salida. Es un guion fijo según la hora, para que sea igual para todos y entre quien entre. */
  function preparacion(g, ec, dt, ts) {
    const tau = T_PREP - ec.falta, m = medidas(), vp = 0.3 * m.bw / m.gpI;
    g.w.forEach(w => {
      const a = w.a, rng = azar(hash("prep" + g.n + w.e.id));
      if (!w.prep) {
        V.soltarSocio(a);
        const parar = 0.4 + rng() * 3.2;
        w.prep = { x0: a.x, f0: a.f, parar, retraso: parar + 0.8 + rng() * 5, ras: rng() };
      }
      const p0 = w.prep, dx = 0 - p0.x0, dfm = (w.f - p0.f0) * 45, d = Math.hypot(dx, dfm);
      const tAnd = clamp(d / vp, 3, Math.max(3.5, 23 - p0.retraso)), vel = d / tAnd;
      const p = clamp((tau - p0.retraso) / tAnd, 0, 1);
      a.x = p0.x0 + dx * p; a.f = p0.f0 + (w.f - p0.f0) * p; a.dir = 1;
      const anda = p > 0 && p < 1;
      w.modo = anda ? (vel > vp * 1.6 ? "trote" : "paso") : "quieto"; w.vm = anda ? vel : 0;
      const arriba = tau > p0.parar;
      if (arriba) { a.obj.echada = a.obj.sentada = a.obj.pasto = 0; a.obj.alerta = 1; }
      const ant = suave((tau - 14) / 12);
      w.ant = ant; a.obj.nervio = a.nervioso * ant;
      w.rasca = (p >= 1 && a.nervioso > 0.42 && ec.falta > 2.5 && ec.falta < 12) ? ((ts / 1000) * 0.85 + p0.ras) % 1 : null;
      a.obj.agacha = ec.falta < 3.5 ? 1 : 0;
      a.flip = acerca(a.flip, 1, 9, dt);
    });
  }

  /* Carrera y lo que sigue: cada criatura sigue su recorrido real hasta la meta, frena y queda libre en la zona de meta */
  function carrera(g, ec, dt, ts) {
    const tr = g.tray, m = medidas();
    if (!tr) {   // el resultado todavía no llegó: esperan en la puerta
      g.w.forEach(w => { w.a.x = 0; w.a.f = w.f; w.a.dir = 1; w.a.flip = 1; w.modo = "quieto"; w.vm = 0; w.a.obj.agacha = 1; });
      return;
    }
    const T = ec.el * tr.factor, cansado = clamp(1 - Math.max(0, ec.post) / (T_RES + T_RECUP), 0.1, 1);
    const mundo = mundoDe(g, "meta", cansado);
    g.w.forEach(w => {
      const k = tr.lista[w.i], a = w.a;
      if (!w.libre) {
        if (T < k.tFin) {
          a.x = k.metros(T); a.f = w.f; a.dir = 1; a.flip = 1; a.obj.agacha = 0;
          const vel = w.xAnt == null ? 0 : (a.x - w.xAnt) / Math.max(0.001, dt);
          w.vm = acerca(w.vm, vel, 10, dt); w.modo = w.vm > 14 ? "galope" : w.vm > 6 ? "trote" : w.vm > 0.8 ? "paso" : "quieto";
          if (ec.el < 0.6) { w.modo = w.vm > 5 ? "trote" : "paso"; }
        } else {
          if (w.v0 == null) w.v0 = Math.max(4, (g.dist - k.metros(k.tFin - 0.4)) / 0.4 * tr.factor);
          const tau = (T - k.tFin) / tr.factor;
          if (tau < TAU_LIBRE) {
            const sF = TAU_FRENO * w.frenoK;
            a.x = g.dist + w.v0 * sF * (1 - Math.exp(-tau / sF)); a.f = w.f; a.dir = 1; a.flip = 1;
            w.vm = w.v0 * Math.exp(-tau / sF); w.modo = w.vm > 0.6 * w.v0 && w.vm > 14 ? "galope" : w.vm > 0.22 * w.v0 && w.vm > 6 ? "trote" : w.vm > 1 ? "paso" : "quieto";
            a.obj.jadeo = clamp(tau / 3, 0, 1) * 0.9;
          } else pasarALibre(g, w, k, mundo);
        }
        w.xAnt = a.x;
      }
    });
    // incidentes (tropiezos y lesiones) cuando pasan por su tramo
    (g.incidentes || []).forEach(inc => {
      if (inc.visto) return;
      const w = g.w.find(x => x.e.id === inc.id);
      if (w && w.a.x >= inc.tramo * 100 + 50 && !w.libre) {
        inc.visto = true;
        if (inc.tipo === "lesion") w.a.cojo = true; else w.tropiezo = ec.el;
        w.av.textContent = inc.tipo === "lesion" ? "✚" : "!"; w.av.classList.add("on");
        if (inc.tipo !== "lesion") setTimeout(() => w.av.classList.remove("on"), 1700);
      }
    });
    libres(g, ec, dt, "meta", cansado);
    // el final: poco antes de acabar la recuperación se van hacia fuera
    if (ec.post > T_RES + T_RECUP - 14) g.w.forEach(w => {
      if (w.libre && w.a.estado !== "salir" && w.a.estado !== "fuera" && ec.post > T_RES + T_RECUP - 14 + w.i * 0.8) { V.soltarSocio(w.a); V.entrar(w.a, "salir", mundo); w.a.obj.jadeo = 0.2; }
    });
  }
  function pasarALibre(g, w, k, mundo) {
    const a = w.a, tr = g.tray;
    if (w.v0 == null) w.v0 = Math.max(4, (g.dist - k.metros(k.tFin - 0.4)) / 0.4 * tr.factor);
    a.x = g.dist + w.v0 * TAU_FRENO * w.frenoK * (1 - Math.exp(-TAU_LIBRE / (TAU_FRENO * w.frenoK))); a.f = w.f; a.dir = 1; a.flip = 1; a.v = 0;
    w.libre = true; w.modo = "quieto"; w.vm = 0;
    a.cojo = a.cojo || !!k.c.lesion;
    a.obj.jadeo = 0.9;
    // cada una reacciona a su manera: la ganadora celebra, las lesionadas se echan, el resto recupera el aire
    const rng = a.rng;
    if (k.c.pos === 1) V.entrar(a, "celebrar", mundo);
    else if (k.c.lesion) V.entrar(a, "echar", mundo);
    else { V.entrar(a, "caminar", mundo); a.dest = { x: mundo.x0 + rng() * (mundo.x1 - mundo.x0), f: rng() }; }   // cada una va a un sitio distinto a recuperar el aire
  }

  /* ---------------------------------------------------------------- cámara */
  function actualizarCamara(g, ec, dt) {
    const m = medidas();
    let objG, objGp = m.gpI, objPx = m.gpI, vel = 1.6, L = camara.g;
    const zi = zonaDe("inicio", g.dist), zm = zonaDe("meta", g.dist);
    const post = ec.fase === "resultados" || ec.fase === "recuperacion";
    if (ec.fase === "preparacion") objG = zi.cam + suave((T_PREP - ec.falta - 6) / 16) * 0.5 * W / m.gpI;   // al final la cámara se acerca a las puertas y deja pista por delante
    else if (ec.fase === "espera" || (ec.fase === "carrera" && !g.tray)) objG = ec.fase === "espera" ? zi.cam : zi.cam + 0.5 * W / m.gpI;
    else if (post) objG = zm.cam;
    else {   // carrera: sigue al pelotón, con zoom que aprieta o abre según lo juntos que vayan
      const xs = g.w.map(w => w.a.x).sort((a, b) => b - a);
      L = xs[0] || 0;
      const kRef = xs[Math.min(xs.length - 1, Math.ceil(xs.length * 0.8) - 1)], spread = Math.max(6, L - kRef);
      objPx = clamp(W * 0.6 / spread, 2.6, 22);
      const cruzo = L >= g.dist + 4;
      objGp = cruzo ? m.gpI : clamp(objPx, 4.5, 9);
      if (cruzo) objPx = m.gpI;
      objG = cruzo ? zm.cam : Math.min(L - 0.22 * W / objGp, g.dist - 0.2 * W / objGp);
      vel = cruzo ? 1.8 : Math.min(5, 1.2 + ec.el * 2);
    }
    camara.gp += (objGp - camara.gp) * Math.min(1, dt * 2.5);
    camara.g += (objG - camara.g) * Math.min(1, dt * vel);
    camara.pxM += (objPx - camara.pxM) * Math.min(1, dt * 3.4);
    const xL = W / 2 + (L - camara.g) * camara.gp;
    camara.c = L - (xL - W / 2) / camara.pxM;
  }

  /* ---------------------------------------------------------------- dibujo */
  function extraFondo(g, c) {
    // detalles del terreno de salida y de meta: fardos, abrevaderos y banderas
    const gx = c.g, y0 = c.y0, sc = Math.max(0.6, c.H / 800), ahora = c.ahora;
    const bala = (x, y, s) => { gx.fillStyle = "#c9a85a"; gx.fillRect(x - 16 * s, y - 16 * s, 32 * s, 16 * s); gx.fillStyle = "#a88a3c"; for (let k = 1; k < 4; k++) gx.fillRect(x - 16 * s + k * 8 * s, y - 16 * s, 1.5 * s, 16 * s); gx.fillStyle = "rgba(0,0,0,.25)"; gx.fillRect(x - 16 * s, y - 2 * s, 32 * s, 2 * s); };
    const agua = (x, y, s) => { gx.fillStyle = "#6c7378"; gx.fillRect(x - 30 * s, y - 12 * s, 60 * s, 12 * s); gx.fillStyle = "#4d8fb8"; gx.fillRect(x - 27 * s, y - 11 * s, 54 * s, 4 * s); gx.fillStyle = "rgba(255,255,255,.35)"; gx.fillRect(x - 20 * s, y - 10.5 * s, 14 * s, 1.4 * s); };
    const bandera = (x, y, s, col) => { gx.fillStyle = "#e8e2d0"; gx.fillRect(x - 1 * s, y - 46 * s, 2 * s, 46 * s); gx.fillStyle = col; gx.beginPath(); const o = Math.sin(ahora * 3 + x * 0.05) * 4 * s; gx.moveTo(x, y - 46 * s); gx.lineTo(x + 24 * s, y - 40 * s + o); gx.lineTo(x, y - 32 * s); gx.closePath(); gx.fill(); };
    const yB = y0 + 0.1 * c.H * 1.0;
    [[-150, "b"], [-122, "b"], [-62, "a"], [-26, "f"], [-10, "f"]].forEach(([m, t]) => { const x = c.xm(m); if (x < -80 || x > c.W + 80) return; if (t === "b") bala(x, yB, 1.2 * sc); else if (t === "a") agua(x, yB, 1.25 * sc); else bandera(x, yB + 4, 1.1 * sc, m === -26 ? "#e85d5d" : "#f1c84b"); });
    const d = g.dist;
    [[28, "f"], [44, "f"], [76, "a"], [112, "b"], [140, "b"]].forEach(([m, t]) => { const x = c.xm(d + m); if (x < -80 || x > c.W + 80) return; if (t === "b") bala(x, yB, 1.2 * sc); else if (t === "a") agua(x, yB, 1.25 * sc); else bandera(x, yB + 4, 1.1 * sc, m === 28 ? "#5da9e8" : "#8bd36a"); });
  }
  function extraFrente(g, c) {
    // polvo de las pisadas
    const gx = c.g, dt = c.dt, mm = camara;
    g.polvo = g.polvo.filter(p => (p.t += dt) < p.dur);
    gx.fillStyle = "#d9c9a0";
    g.polvo.forEach(p => {
      const u = p.t / p.dur, x = W / 2 + (p.m - mm.c) * mm.pxM - u * 18, y = H * CBASE - p.f * H * CANCHO - 6 - u * 18 * p.k;
      gx.globalAlpha = 0.34 * (1 - u) * p.k; gx.beginPath(); gx.arc(x, y, (6 + u * 16) * p.k, 0, 7); gx.fill();
    });
    gx.globalAlpha = 1;
  }

  function dibujar(g, ec, ts, dt) {
    const tSeg = ts / 1000, m = medidas(), bw = m.bw;
    g.escenario.fondo(camara.g, camara.gp, tSeg, c => extraFondo(g, c));
    const abre = ec.fase === "carrera" || ec.fase === "resultados" || ec.fase === "recuperacion";
    const nom = new Map();
    if (ec.fase === "carrera" && g.tray) g.w.slice().sort((a, b) => b.a.x - a.a.x).forEach((w, i) => nom.set(w, i + 1));
    g.w.forEach(w => {
      const a = w.a, f = a.f, esc = 1 - f * 0.34, wpx = bw * esc, hpx = wpx * 148 / 240;
      const xs = W / 2 + (a.x - camara.c) * camara.pxM, ys = H * CBASE - f * H * CANCHO;
      const vis = xs > -wpx * 0.8 && xs < W + wpx * 0.8;
      const ctx = { dt, pxPorUnidad: wpx / 240 * a.titere.R.k, vPx: w.vm * camara.gp, modo: w.modo, ant: w.ant || 0, rasca: w.rasca, omitir: !vis, inclina: 0 };
      if (w.tropiezo != null) { const u = (ec.el - w.tropiezo) / 0.7; if (u >= 1) w.tropiezo = null; else ctx.inclina = 10 * Math.sin(Math.PI * u); }
      V.pintarActor(a, ctx);
      if (!vis) { if (w.visible) { w.el.style.visibility = "hidden"; w.visible = false; } return; }
      if (!w.visible) { w.el.style.visibility = "visible"; w.visible = true; }
      if (Math.abs(w.wAncho - wpx) > 0.5) { w.el.style.width = wpx.toFixed(1) + "px"; w.wAncho = wpx; }
      w.el.style.transform = "translate(" + (xs - wpx / 2).toFixed(1) + "px," + (ys - hpx * 0.919).toFixed(1) + "px)";
      w.el.style.zIndex = 2 * (1000 - Math.round(f * 900));
      if (Math.abs(a.flip - w.flipPrev) > 0.01) { w.giro.style.transform = Math.abs(a.flip - 1) < 0.01 ? "" : "scaleX(" + a.flip.toFixed(2) + ")"; w.flipPrev = a.flip; }
      // nombre a la vista: en la espera todos; en carrera solo los cuatro primeros
      const conNombre = ec.fase === "carrera" ? (nom.get(w) || 9) <= 4 : ec.fase !== "vacio";
      w.el.classList.toggle("con-nombre", conNombre);
      // polvo de galope
      if (w.modo === "galope" && w.vm > 10) { w.tPolvo = (w.tPolvo || 0) - dt; if (w.tPolvo <= 0 && g.polvo.length < 160) { w.tPolvo = 0.09; g.polvo.push({ m: a.x - 4, f, t: 0, dur: 0.8, k: esc }); } }
    });
    // puertas de salida
    const abierta = abre || ec.fase === "vacio" && false;
    g.puertas.forEach((pu, i) => {
      const w = g.w[i]; if (!w) return;
      const f = w.f, esc = 1 - f * 0.34, wpx = bw * esc, hpx = wpx * 148 / 240, xs = W / 2 + (0 - camara.c) * camara.pxM + wpx * 0.46, ys = H * CBASE - f * H * CANCHO;
      pu.style.width = (wpx * 0.1).toFixed(1) + "px"; pu.style.height = (hpx * 0.78).toFixed(1) + "px";
      pu.style.transform = "translate(" + xs.toFixed(1) + "px," + (ys - hpx * 0.78).toFixed(1) + "px)";
      pu.style.zIndex = 2 * (1000 - Math.round(f * 900)) + 1;
      pu.classList.toggle("abierta", abierta);
    });
    g.escenario.frente(camara.g, camara.gp, tSeg, dt, tSeg, c => extraFrente(g, c));
  }

  /* ---------------------------------------------------------------- interfaz */
  function mensaje(txt, clase, ms) {
    const el = $("hvMsg");
    if (el._t !== txt || el._c !== clase) { el.textContent = txt; el.className = "hv-mensaje on pulso" + (clase ? " " + clase : ""); el._t = txt; el._c = clase; void el.offsetWidth; }
    mensajeHasta = performance.now() + ms;
  }
  function apagarMensaje(ahoraPerf) {
    if (mensajeHasta && ahoraPerf > mensajeHasta) { const el = $("hvMsg"); el.classList.remove("on", "pulso"); el._t = null; mensajeHasta = 0; }
  }
  const colorDe = id => PI.colorDe(id);

  function tablaResultado(res) {
    const filas = res.llegada.map(l => `<tr class="${l.pos === 1 ? "oro" : ""}"><td class="n">${l.pos}</td><td>${escH(l.nombre)}</td><td>${M.fmtTiempo(l.t)}</td><td>${l.pos === 1 ? "—" : escH(M.fmtMargen(l.margen))}</td><td>${l.premio ? l.premio : ""}</td></tr>`).join("");
    return `<table><thead><tr><th>Pos.</th><th>Criatura</th><th>Tiempo</th><th>Margen</th><th>Premio</th></tr></thead><tbody>${filas}</tbody></table>` +
      (res.fotoMeta ? "<p>Foto de meta: la llegada fue tan justa que hizo falta mirar la imagen.</p>" : "");
  }

  function actualizarHud(g, ec, ahora, ts) {
    const reg = ec.reg, prog = reg ? reg.prog : null, res = reg ? reg.res : null;
    document.body.dataset.fase = ec.fase;
    textoDe($("hvFase"), FASES[ec.fase]);
    // cabecera
    textoDe($("hvNum"), prog ? "Carrera n.º " + prog.n + (prog.grado && M.GRADOS[prog.grado] ? " · " + M.GRADOS[prog.grado].nombre : "") : "Carrera");
    textoDe($("hvNombre"), prog ? prog.nombre : (fuente ? "Preparando la próxima carrera..." : "Conectando con el hipódromo..."));
    let etiqueta = "Próxima salida", valor = "--:--";
    if (ec.fase === "espera" || ec.fase === "preparacion") { etiqueta = "Salida en"; valor = mmss(ec.falta * 1000); }
    else if (ec.fase === "carrera") {
      etiqueta = "Faltan";
      if (g.tray) { const lider = Math.max.apply(null, g.w.map(w => w.a.x)); valor = Math.max(0, Math.round((g.dist - Math.min(lider, g.dist)) / 10) * 10) + " m"; if (lider >= g.dist) valor = "META"; }
      else valor = prog ? prog.dist + " m" : "--";
    } else if (ec.prox) valor = mmss(ec.prox.hora - ahora);
    textoDe($("hvCuentaTxt"), etiqueta); textoDe($("hvCuenta"), valor);
    // datos
    if (prog) {
      const pista = M.PISTAS[prog.pista];
      poner($("hvDatos"), `<span><b>${prog.dist} m</b> · ${escH(pista ? pista.nombre : "")}</span>` +
        `<span>Terreno: <b>${res ? escH(res.estadoPista) : "por confirmar"}</b></span>` +
        `<span>${res ? "Clima" : "Ahora"}: <b>${escH(nombreClima(res ? res.clima : prog.climaPrevio))}</b></span>` +
        `<span>Bolsa: <b>${prog.bolsa}</b></span>`);
    } else poner($("hvDatos"), "");
    // participantes / posiciones / llegada
    if (g && g.w.length) {
      let tit = "Participantes", html = "";
      if (ec.fase === "carrera" && g.tray) {
        tit = "Posiciones";
        const orden = g.w.slice().sort((a, b) => (a.libre !== b.libre ? (a.libre ? -1 : 1) : (b.a.x - a.a.x) || (a.e.puerta - b.e.puerta)));
        const fin = g.w.filter(w => g.tray.lista[w.i] && (ec.el * g.tray.factor) >= g.tray.lista[w.i].tFin).sort((a, b) => g.tray.lista[a.i].c.pos - g.tray.lista[b.i].c.pos);
        const en = orden.filter(w => !fin.includes(w));
        html = fin.concat(en).map((w, i) => `<li class="${w.el.classList.contains("mia") ? "mia" : ""}${i === 0 && fin.length ? " oro" : ""}"><b>${i + 1}</b><i style="background:${colorDe(w.e.id)}"></i><span>${escH(w.e.nombre)}</span></li>`).join("");
        g.w.forEach(w => { w._lugar = 0; });
      } else if ((ec.fase === "resultados" || ec.fase === "recuperacion") && res) {
        tit = "Llegada";
        html = res.llegada.map(l => `<li class="${l.pos === 1 ? "oro" : ""}"><b>${l.pos}</b><i style="background:${colorDe(l.id)}"></i><span>${escH(l.nombre)}</span><em>${M.fmtTiempo(l.t)}</em></li>`).join("");
      } else {
        html = g.w.slice().sort((a, b) => a.e.puerta - b.e.puerta).map(w => `<li class="${w.el.classList.contains("mia") ? "mia" : ""}"><b>${w.e.puerta}</b><i style="background:${colorDe(w.e.id)}"></i><span>${escH(w.e.nombre)}</span><em>${w.e.gan ? "×" + M.fmtCuota(w.e.gan) : ""}</em></li>`).join("");
      }
      textoDe($("hvPuestosTit"), tit); poner($("hvLista"), html);
      $("hvPuestos").hidden = false;
    } else $("hvPuestos").hidden = true;
    // barra de progreso en carrera
    if (ec.fase === "carrera" && g.tray) poner($("hvProgBarra"), g.w.map(w => `<i style="left:${(clamp(Math.min(w.a.x, g.dist) / g.dist, 0, 1) * 100).toFixed(1)}%;background:${colorDe(w.e.id)}"></i>`).join(""));
    // avisos
    textoDe($("hvAviso"), aviso || (ec.fase === "vacio" ? "No hay una carrera programada todavía. Vuelve en unos minutos." : (reg && !res && ec.fase === "carrera" ? "Esperando el resultado oficial de la carrera..." : "")));
    // resultados
    const hayRes = !!(res && (ec.fase === "resultados" || ec.fase === "recuperacion"));
    $("hvVerRes").hidden = !hayRes;
    if (panel.n !== (reg && reg.n)) { panel = { n: reg ? reg.n : null, cerrado: false, abierto: false }; $("hvRes").hidden = true; }
    if (hayRes) {
      if (!panel.abierto && ec.fase === "resultados") { panel.abierto = true; $("hvRes").hidden = panel.cerrado; textoDe($("hvResTit"), prog.nombre); poner($("hvResCuerpo"), tablaResultado(res)); }
      if (ec.fase === "recuperacion" && !panel.cerrado && !panel.manual && !$("hvRes").hidden && ec.post > T_RES + 12) { $("hvRes").hidden = true; }
    } else if (!panel.manual) $("hvRes").hidden = true;
    // música
    const sonando = ec.fase === "preparacion" || ec.fase === "carrera";
    if (window.MusicaPaginas && musicaCarrera !== sonando) { musicaCarrera = sonando; window.MusicaPaginas.partida(sonando); }
    if (window.MusicaPaginas && window.MusicaPaginas.estado) { const s = window.MusicaPaginas.estado(); $("hvSonido").hidden = !(s.configurada && !s.sonando && !s.silencio && s.esperaGesto); }
  }

  /* cuenta atrás, salida y ganadora */
  function momentos(g, ec) {
    const ahoraPerf = performance.now();
    if (ec.fase === "preparacion") {
      const c = Math.ceil(ec.falta);
      if (c <= 5 && c >= 1) mensaje(String(c), "", 1100);
      else if (c === 30 || (c === 29 && ec._p !== 1)) { /* nada */ }
    } else if (ec.fase === "carrera") {
      if (ec.el >= 0 && ec.el < 1.4 && g.tray) mensaje("¡SALIDA!", "", 1400);
      if (g.tray && !g.ganadorVisto) {
        const T = ec.el * g.tray.factor, gan = g.tray.lista.find(k => k.c.pos === 1);
        if (gan && T >= gan.tFin) {
          g.ganadorVisto = true;
          const w = g.w.find(x => x.e.id === gan.c.id);
          if (w) w.el.classList.add("ganador");
          mensaje("★ " + gan.c.nombre, "chico", 5000);
        }
      }
    } else if (ec.fase === "resultados" && g.tray && !g.ganadorVisto) {
      g.ganadorVisto = true;
      const w = g.w.find(x => x.e.id === g.tray.lista.find(k => k.c.pos === 1).c.id); if (w) w.el.classList.add("ganador");
    }
    apagarMensaje(ahoraPerf);
  }

  /* ---------------------------------------------------------------- el bucle */
  function iniciarFundido(fn) {
    if (cambio) return;
    $("hvFundido").classList.add("on");
    cambio = { t: performance.now() + T_FUNDIDO, fn };
  }
  function bucle(ts) { requestAnimationFrame(bucle); cuadro(ts); }
  function cuadro(ts) {
    const dt = clamp((ts - ultimoMarco) / 1000, 0, 0.1); ultimoMarco = ts;
    if (!fuente) return;
    const ahora = fuente.ahora(), ec = escenaDe(ahora);
    // qué pista toca: si cambia la carrera, un fundido y la pista nueva
    const deseado = ec.reg ? ec.reg.n : null;
    if (cambio) {
      if (ts >= cambio.t) { const fn = cambio.fn; cambio = null; fn(); $("hvFundido").classList.remove("on"); }
    } else if (!grupo) { if (esperandoPrevia()) return; construirGrupo(ec.reg, false); }
    else if (grupo.n !== deseado) iniciarFundido(() => { const e2 = escenaDe(fuente.ahora()); construirGrupo(e2.reg, e2.fase === "espera" || e2.fase === "preparacion"); panel = { n: null, cerrado: false }; });
    const g = grupo;
    if (!g) return;
    if (g.reg && g.reg.res && !g.resAplicada) aplicarResultado(g);
    if (g.n === deseado || !deseado) {
      if (ec.fase === "espera") libres(g, ec, dt, "inicio", 0);
      else if (ec.fase === "preparacion") preparacion(g, ec, dt, ts);
      else if (ec.fase === "vacio") libres(g, ec, dt, "inicio", 0);
      else carrera(g, ec, dt, ts);
      if (g.snap) { g.snap = false; actualizarCamara(g, ec, 10); actualizarCamara(g, ec, 10); }   // la pista recién puesta ya empieza bien encuadrada
      else actualizarCamara(g, ec, dt);
      dibujar(g, ec, ts, dt);
      momentos(g, ec);
    }
    if (ts - ultimoHud > 120) { ultimoHud = ts; actualizarHud(g, ec, ahora, ts); }
  }

  /* ---------------------------------------------------------------- arranque */
  function arrancar() {
    medirPantalla();
    window.addEventListener("resize", medirPantalla);
    $("hvVerRes").addEventListener("click", () => { const el = $("hvRes"), reg = grupo && grupo.reg; if (!reg || !reg.res) return; el.hidden = !el.hidden; panel.manual = true; panel.cerrado = el.hidden; textoDe($("hvResTit"), reg.prog.nombre); poner($("hvResCuerpo"), tablaResultado(reg.res)); });
    $("hvResCerrar").addEventListener("click", () => { $("hvRes").hidden = true; panel.cerrado = true; panel.manual = true; });
    iniciar().then(() => { setInterval(tickDatos, 300); });
    requestAnimationFrame(ts => { ultimoMarco = ts; bucle(ts); });
  }
  window.__hv = { cuadro, registro, get grupo() { return grupo; }, get fuente() { return fuente; }, camara: () => camara, escenaDe: () => escenaDe(fuente.ahora()) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
})();
